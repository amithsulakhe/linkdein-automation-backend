import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalFilename: { type: String, required: true },
    storageKey: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    extractionStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    chunkCount: { type: Number, default: 0 },
    pageCount: { type: Number },
    fileUrl: { type: String },
    cloudinaryPublicId: { type: String },
    errorInformation: { type: String },
  },
  { timestamps: true }
);

export const Document = mongoose.model('Document', documentSchema);
