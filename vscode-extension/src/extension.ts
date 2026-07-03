import * as path from 'path';
import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: any;

export function activate(context: any) {
  // 1. Path to the LSP Daemon server module
  const serverModule = context.asAbsolutePath(
    path.join('..', 'lsp', 'dist', 'server.js')
  );

  // Debug options for the server (port 6009)
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  // Server options: run node on the serverModule path
  const serverOptions: any = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  // Client options
  const clientOptions: any = {
    documentSelector: [
      { scheme: 'file', language: 'javascript' },
      { scheme: 'file', language: 'typescript' },
      { scheme: 'file', language: 'javascriptreact' },
      { scheme: 'file', language: 'typescriptreact' },
      { scheme: 'file', language: 'html' }
    ]
  };

  // Create the Language Client
  client = new LanguageClient(
    'jsCodeAnalyzer',
    'JS Code Analyzer Language Server',
    serverOptions,
    clientOptions
  );

  // Start client and boot daemon
  client.start();

  // 2. Register Code Actions Provider (Quick Fixes)
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      clientOptions.documentSelector as any,
      new AISuggestionQuickFixProvider(),
      {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
      }
    )
  );

  vscode.window.showInformationMessage('JS Code Analyzer is monitoring your workspace.');
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

/**
 * Quick Fix provider fetching AI suggestions from MERN backend to resolve diagnostics.
 */
class AISuggestionQuickFixProvider {
  public async provideCodeActions(
    document: any,
    range: any,
    context: any,
    token: any
  ): Promise<any[]> {
    const codeActions: any[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source === 'JS Code Analyzer' && diagnostic.code) {
        const issueId = String(diagnostic.code);
        if (issueId.startsWith('local_')) continue; // Skip local dev diagnostics

        // Fetch configurations
        const config: any = vscode.workspace.getConfiguration('jsCodeAnalyzer');
        const backendUrl = config.get('backendUrl') || 'http://localhost:5000';
        const apiKey = config.get('apiKey') || '';

        try {
          const suggestion = await this.fetchAISuggesion(backendUrl, issueId, apiKey);
          if (suggestion && suggestion.fixCode) {
            const action = new (vscode as any).CodeAction(
              `Apply AI Fix: ${suggestion.explanation.substring(0, 50)}...`,
              vscode.CodeActionKind.QuickFix
            );
            action.diagnostics = [diagnostic];
            action.isPreferred = true;

            const edit = new (vscode as any).WorkspaceEdit();
            edit.replace(document.uri, diagnostic.range, suggestion.fixCode);
            action.edit = edit;

            codeActions.push(action);
          }
        } catch (e) {
          // Suppress errors during quick action fetches
        }
      }
    }

    return codeActions;
  }

  private fetchAISuggesion(
    backendUrl: string,
    issueId: string,
    apiKey: string
  ): Promise<{ explanation: string; fixCode: string } | null> {
    return new Promise((resolve) => {
      const url = `${backendUrl}/api/issues/detail/${issueId}`;
      const clientModule = url.startsWith('https') ? https : http;
      const options = {
        headers: {
          'x-api-key': apiKey
        }
      };
      clientModule.get(url, options, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json && json.status === 'success' && json.data?.aiSuggestion) {
              resolve({
                explanation: json.data.aiSuggestion.explanation || 'Fix layout style',
                fixCode: json.data.aiSuggestion.fixCode
              });
              return;
            }
          } catch (e) {}
          resolve(null);
        });
      }).on('error', () => resolve(null));
    });
  }
}
