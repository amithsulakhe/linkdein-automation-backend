import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    sources: [
      {
        type: { type: String },
        id: { type: String },
        label: { type: String },
        excerpt: { type: String },
      },
    ],
    toolCalls: [{ type: mongoose.Schema.Types.Mixed }],
  },
  { timestamps: true }
);

const chatConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'New conversation' },
    messages: [chatMessageSchema],
  },
  { timestamps: true }
);

export const ChatConversation = mongoose.model('ChatConversation', chatConversationSchema);
