import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import http from 'http';
import axios from 'axios';

// 1. Create a connection for the server, using Node's IPC or stdin/stdout
const connection = createConnection(ProposedFeatures.all);

// 2. Create a simple text document manager
const documents: any = new (TextDocuments as any)(TextDocument);

// 3. Cache settings
interface Settings {
  projectId: string;
  apiKey: string;
  backendUrl: string;
  environmentFilter: string;
}

let globalSettings: Settings = {
  projectId: 'demo_proj_1',
  apiKey: '',
  backendUrl: 'http://localhost:5000',
  environmentFilter: 'development'
};

// 4. In-memory cache of diagnostics fetched from backend + local SDK triggers
interface IssueData {
  _id: string;
  category: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  location: {
    line?: number;
    column?: number;
    fileName?: string;
    originalLocation?: {
      line: number;
      column: number;
      fileName: string;
      sourceContent?: string;
    };
  };
}

let cachedIssues: IssueData[] = [];
let localDevIssues: IssueData[] = [];

connection.onInitialize((params: any) => {
  const result: any = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental
    }
  };
  return result;
});

connection.onInitialized(() => {
  connection.client.register(DidChangeConfigurationNotification.type, undefined);
  
  // Start the background poll loops and local diagnostic listener
  startBackendPolling();
  startLocalDiagnosticListener();
  
  connection.console.log('[LSP Daemon] Language Server initialized successfully.');
});

connection.onDidChangeConfiguration((change: any) => {
  if (change.settings && change.settings.jsCodeAnalyzer) {
    globalSettings = {
      ...globalSettings,
      ...change.settings.jsCodeAnalyzer
    };
    connection.console.log(`[LSP Daemon] Config updated: projectId=${globalSettings.projectId}, backendUrl=${globalSettings.backendUrl}`);
    // Immediately poll backend with new settings
    pollIssues();
  }
});

// Watch document lifecycle to trigger updates
documents.onDidOpen((e: any) => {
  validateTextDocument(e.document);
});

documents.onDidSave((e: any) => {
  validateTextDocument(e.document);
});

documents.listen(connection);

/**
 * Periodically fetches unresolved issues from the MERN backend database.
 */
function startBackendPolling() {
  setInterval(pollIssues, 10000); // every 10 seconds
  pollIssues();
}

async function pollIssues() {
  try {
    const { backendUrl, projectId, apiKey } = globalSettings;
    if (!backendUrl || !projectId) return;

    // Fetch active issues
    const url = `${backendUrl}/api/issues/${projectId}?resolved=false`;
    const response = await axios.get(url, {
      headers: apiKey ? { 'x-api-key': apiKey } : {}
    });

    const issuesList = response.data && response.data.data && response.data.data.issues;
    if (Array.isArray(issuesList)) {
      cachedIssues = issuesList;
      connection.console.log(`[LSP Daemon] Synced ${cachedIssues.length} issues from backend.`);
      
      // Re-validate all open documents with the new cache
      documents.all().forEach(validateTextDocument);
    }
  } catch (err: any) {
    connection.console.log(`[LSP Daemon] Poll failed: ${err.message}`);
  }
}

/**
 * Validates a text document by matching its URI with cached database issues.
 */
function validateTextDocument(textDocument: any): void {
  const diagnostics: any[] = [];
  const docPath = decodeURIComponent(textDocument.uri).toLowerCase();

  // Combine remote database issues and local live development issues
  const allIssues = [...cachedIssues, ...localDevIssues];

  for (const issue of allIssues) {
    const loc = issue.location;
    if (!loc) continue;

    // 1. Determine target file name and position
    // Prioritize originalLocation (resolved source map), fallback to main location
    const targetFile = loc.originalLocation?.fileName || loc.fileName;
    const targetLine = loc.originalLocation?.line || loc.line;
    const targetCol = loc.originalLocation?.column || loc.column;

    if (!targetFile || !targetLine) continue;

    // 2. Check if the issue belongs to the open document
    const matchSuffix = targetFile.toLowerCase().replace(/\\/g, '/');
    if (docPath.endsWith(matchSuffix)) {
      // LSP uses 0-based indexes for lines and characters
      const line = Math.max(0, targetLine - 1);
      const col = Math.max(0, (targetCol || 1) - 1);

      // Determine severity mapping
      let severity = DiagnosticSeverity.Warning;
      if (issue.severity === 'critical' || issue.severity === 'high') {
        severity = DiagnosticSeverity.Error;
      }

      diagnostics.push({
        severity,
        range: {
          start: { line, character: col },
          end: { line, character: col + 80 } // Highlight line portion
        },
        message: `[JS Analyzer] ${issue.title}: ${issue.message}`,
        source: 'JS Code Analyzer',
        code: issue._id
      });
    }
  }

  // Publish warnings to the client editor
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

/**
 * Hosts a local loopback server on port 3003.
 * Client-side SDK in development env sends JSON telemetry here directly.
 */
function startLocalDiagnosticListener() {
  const server = http.createServer((req: any, res: any) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/local-diagnostic') {
      let body = '';
      req.on('data', (chunk: any) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const issues: IssueData[] = Array.isArray(payload) ? payload : [payload];

          // Add random ID to prevent collisions and keep them in local buffer
          const enriched = issues.map(issue => ({
            ...issue,
            _id: issue._id || `local_${Math.random().toString(36).substring(2, 9)}`
          }));

          // Merge and limit history size
          localDevIssues = [...enriched, ...localDevIssues].slice(0, 100);
          connection.console.log(`[LSP Daemon] Received ${enriched.length} local telemetry updates.`);

          // Instantly re-validate open documents
          documents.all().forEach(validateTextDocument);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'success' }));
        } catch (e: any) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.on('error', (err: any) => {
    connection.console.error(`[LSP Daemon] Failed to start local loopback listener (port 3003 might be in use): ${err.message}`);
  });

  server.listen(3003, () => {
    connection.console.log('[LSP Daemon] Local Dev-Server Hook listening on http://localhost:3003/local-diagnostic');
  });
}

// Start listening for client LSP requests
connection.listen();
