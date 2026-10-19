import mongoose from 'mongoose';

const documentChunkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    documentName: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    sourceMetadata: {
      page: { type: Number },
      section: { type: String },
    },
  },
  { timestamps: true }
);

documentChunkSchema.index({ userId: 1, documentId: 1, chunkIndex: 1 }, { unique: true });

export const DocumentChunk = mongoose.model('DocumentChunk', documentChunkSchema);
