import mongoose from 'mongoose';

const oauthConnectionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['linkedin', 'gmail'], required: true },
    encryptedAccessToken: { type: String, required: true },
    encryptedRefreshToken: { type: String },
    tokenExpiry: { type: Date },
    grantedScopes: [{ type: String }],
    connectionStatus: {
      type: String,
      enum: ['connected', 'expired', 'revoked', 'error'],
      default: 'connected',
    },
    providerUserId: { type: String },
    providerEmail: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

oauthConnectionSchema.index({ userId: 1, provider: 1 }, { unique: true });

export const OAuthConnection = mongoose.model('OAuthConnection', oauthConnectionSchema);
