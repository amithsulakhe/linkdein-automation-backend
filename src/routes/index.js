import { Router } from 'express';
import authRoutes from './authRoutes.js';
import healthRoutes from './healthRoutes.js';
import { authenticate, loadUser } from '../middleware/auth.js';
import {
  linkedInConnect,
  linkedInCallback,
  linkedInStatus,
  linkedInDisconnect,
  gmailConnect,
  gmailCallback,
  gmailStatus,
} from '../controllers/integrationController.js';
import {
  listPosts,
  createDraft,
  getPost,
  updatePost,
  requestApproval,
  listApprovals,
  getApproval,
  reviewByToken,
  confirmApprovalAction,
  composeAndSendMail,
  generateComposeDraft,
  resendApprovalEmail,
  retryPublish,
  streamPostImage,
} from '../controllers/postController.js';
import { postImageUpload } from '../middleware/postImageUpload.js';
import {
  overview,
  postsAnalytics,
  timeseries,
  usageSummary,
  syncAnalytics,
} from '../controllers/analyticsController.js';
import {
  uploadDocument,
  streamDocumentFile,
  listDocuments,
  getDocument,
  removeDocument,
  reprocessDocument,
  documentStatus,
} from '../controllers/documentController.js';
import {
  createConversation,
  listConversations,
  getMessages,
  sendMessage,
} from '../controllers/chatController.js';
import { getSettings, patchSettings, jobsStatus, resetUserData } from '../controllers/settingsController.js';
import { uploadMiddleware } from '../middleware/upload.js';

const router = Router();

router.use(healthRoutes);
router.use('/auth', authRoutes);

router.get('/integrations/linkedin/connect', authenticate, loadUser, linkedInConnect);
router.get('/integrations/linkedin/callback', linkedInCallback);
router.get('/integrations/linkedin/status', authenticate, loadUser, linkedInStatus);
router.delete('/integrations/linkedin', authenticate, loadUser, linkedInDisconnect);

router.get('/integrations/gmail/connect', authenticate, loadUser, gmailConnect);
router.get('/integrations/gmail/callback', gmailCallback);
router.get('/integrations/gmail/status', authenticate, loadUser, gmailStatus);

const protectedRoutes = [authenticate, loadUser];

router.get('/posts', protectedRoutes, listPosts);
router.post('/posts/drafts', protectedRoutes, createDraft);
router.post('/posts/generate', protectedRoutes, generateComposeDraft);
router.post(
  '/posts/compose/send-mail',
  protectedRoutes,
  postImageUpload.single('image'),
  composeAndSendMail
);
router.get('/posts/:id/image', protectedRoutes, streamPostImage);
router.get('/posts/:id', protectedRoutes, getPost);
router.patch('/posts/:id', protectedRoutes, updatePost);
router.post('/posts/:id/request-approval', protectedRoutes, requestApproval);
router.post('/posts/:id/resend-approval-email', protectedRoutes, resendApprovalEmail);
router.post('/posts/:id/retry-publish', protectedRoutes, retryPublish);

router.get('/approvals', protectedRoutes, listApprovals);
router.get('/approvals/review', protectedRoutes, reviewByToken);
router.get('/approvals/:id', protectedRoutes, getApproval);
router.post('/approvals/confirm', protectedRoutes, confirmApprovalAction);
router.post('/approvals/:id/confirm', protectedRoutes, confirmApprovalAction);

router.get('/analytics/overview', protectedRoutes, overview);
router.get('/analytics/usage', protectedRoutes, usageSummary);
router.get('/analytics/posts', protectedRoutes, postsAnalytics);
router.get('/analytics/timeseries', protectedRoutes, timeseries);
router.post('/analytics/sync', protectedRoutes, syncAnalytics);

router.post('/documents/upload', protectedRoutes, uploadMiddleware.single('file'), uploadDocument);
router.get('/documents', protectedRoutes, listDocuments);
router.get('/documents/:id/file', protectedRoutes, streamDocumentFile);
router.get('/documents/:id', protectedRoutes, getDocument);
router.delete('/documents/:id', protectedRoutes, removeDocument);
router.post('/documents/:id/reprocess', protectedRoutes, reprocessDocument);
router.get('/documents/:id/status', protectedRoutes, documentStatus);

router.post('/chat/conversations', protectedRoutes, createConversation);
router.get('/chat/conversations', protectedRoutes, listConversations);
router.get('/chat/conversations/:id/messages', protectedRoutes, getMessages);
router.post('/chat/conversations/:id/messages', protectedRoutes, sendMessage);

router.get('/settings', protectedRoutes, getSettings);
router.patch('/settings', protectedRoutes, patchSettings);
router.post('/settings/reset-data', protectedRoutes, resetUserData);
router.get('/jobs/status', protectedRoutes, jobsStatus);

export default router;
