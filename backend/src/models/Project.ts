import { Schema, model } from 'mongoose';

const ProjectSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  webhookUrl: {
    type: String,
    trim: true,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const Project = model('Project', ProjectSchema);
export default Project;
