import { Schema, model } from 'mongoose';
import crypto from 'crypto';

const ApiKeySchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  maskedKey: {
    type: String,
    default: ''
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

ApiKeySchema.pre('save', function (next) {
  if (this.isModified('key')) {
    const raw = this.key;
    if (raw.length > 12) {
      this.maskedKey = `${raw.substring(0, 10)}...${'*'.repeat(12)}`;
    } else {
      this.maskedKey = 'key_masked...';
    }
    this.key = crypto.createHash('sha256').update(this.key).digest('hex');
  }
  next();
});

export const ApiKey = model('ApiKey', ApiKeySchema);
export default ApiKey;
