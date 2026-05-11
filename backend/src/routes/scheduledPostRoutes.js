import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import {
  listScheduledPosts,
  createScheduledPost,
  cancelScheduledPost,
} from '../controllers/scheduledPostController.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.join(__dirname, '../../uploads/scheduled');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(uploadRoot, { recursive: true });
      cb(null, uploadRoot);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const safe = `${Date.now()}-${file.originalname}`.replace(/[^\w.\- ]+/g, '_');
    cb(null, safe);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 },
});

const router = express.Router();
router.use(authenticate);
router.get('/', listScheduledPosts);
router.post('/', upload.single('media'), createScheduledPost);
router.delete('/:id', cancelScheduledPost);

export default router;
