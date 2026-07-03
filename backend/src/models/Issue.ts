import { Schema, model } from 'mongoose';

const OccurrenceSampleSchema = new Schema({
  url: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  location: {
    line: Number,
    column: Number,
    selector: String,
    outerHTML: String,
    fileName: String,
    originalLocation: {
      line: Number,
      column: Number,
      fileName: String,
      sourceContent: String
    }
  },
  metadata: Schema.Types.Mixed
}, { _id: false });

const IssueSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  fingerprint: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    enum: ['html', 'css', 'javascript', 'dom', 'performance', 'accessibility', 'seo', 'security', 'code-quality', 'dx']
  },
  type: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical']
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  resolved: {
    type: Boolean,
    default: false,
    index: true
  },
  occurrencesCount: {
    type: Number,
    default: 1
  },
  firstOccurrence: {
    type: Date,
    default: Date.now
  },
  lastOccurrence: {
    type: Date,
    default: Date.now
  },
  // Canonical sample location for overview
  location: {
    line: Number,
    column: Number,
    selector: String,
    outerHTML: String,
    fileName: String,
    originalLocation: {
      line: Number,
      column: Number,
      fileName: String,
      sourceContent: String
    }
  },
  metadata: Schema.Types.Mixed,
  aiSuggestion: {
    explanation: { type: String, default: '' },
    fixCode: { type: String, default: '' },
    referenceUrl: { type: String, default: '' }
  },
  // Ring buffer list of recent occurrences
  occurrencesHistory: [OccurrenceSampleSchema]
});

// Set compound unique index on project and fingerprint
IssueSchema.index({ projectId: 1, fingerprint: 1 }, { unique: true });

export const Issue = model('Issue', IssueSchema);
export default Issue;
