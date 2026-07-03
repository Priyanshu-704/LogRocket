import { Schema, model } from 'mongoose';

const ReportSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  environment: {
    type: String,
    required: true,
    default: 'production'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  sdkVersion: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  metrics: {
    type: Schema.Types.Mixed,
    default: {}
  },
  issuesCount: {
    type: Number,
    default: 0
  },
  eventsCount: {
    type: Number,
    default: 0
  }
});

export const Report = model('Report', ReportSchema);
export default Report;
