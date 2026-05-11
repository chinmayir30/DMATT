import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { postToAllPlatforms } from '../controllers/socialHubController.js';
import multer from 'multer';
import os from 'os';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const uploadDir = path.join(os.tmpdir(), 'dmat-social-hub-uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
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

router.use(authenticate);
router.post('/post-all', upload.single('media'), postToAllPlatforms);

export default router;
