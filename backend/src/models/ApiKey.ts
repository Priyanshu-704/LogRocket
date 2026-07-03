import { Schema, model } from 'mongoose';

const ApiKeySchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  name: {
    type: String,
    required: true,
    default: 'Default SDK Key'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const ApiKey = model('ApiKey', ApiKeySchema);
export default ApiKey;
