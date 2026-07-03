import { Schema, model } from 'mongoose';

export interface ISourceMap {
  projectId: Schema.Types.ObjectId;
  fileName: string;
  rawSourceMap: string; // Stored as a raw stringified JSON
  createdAt: Date;
}

const SourceMapSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  fileName: {
    type: String,
    required: true,
    index: true
  },
  rawSourceMap: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure uniqueness per project/file
SourceMapSchema.index({ projectId: 1, fileName: 1 }, { unique: true });

export const SourceMap = model<ISourceMap>('SourceMap', SourceMapSchema);
export default SourceMap;
