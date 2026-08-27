import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import upload from '../middlewares/upload.middleware';
import pdfUpload from '../middlewares/pdfUpload.middleware';

const router = Router();

router.post(
  '/',
  authMiddleware,
  authorize('admin', 'super_admin'),
  upload.single('file'),
  (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const base = `${req.protocol}://${req.get('host')}`;
    const url = `${base}/uploads/${req.file.filename}`;
    res.json({ success: true, url });
  },
);

router.post(
  '/pdf',
  authMiddleware,
  authorize('admin', 'super_admin'),
  pdfUpload.single('file'),
  (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const base = `${req.protocol}://${req.get('host')}`;
    const url = `${base}/uploads/${req.file.filename}`;
    res.json({
      success: true,
      name: req.file.originalname,
      size: req.file.size,
      url,
      uploadedAt: new Date().toISOString(),
    });
  },
);

export default router;
