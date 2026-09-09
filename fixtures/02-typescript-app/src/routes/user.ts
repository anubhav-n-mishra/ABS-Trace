import { Router, Request, Response } from 'express';
import { UserService } from '../services/UserService.js';

const router = Router();
const userService = new UserService();

router.get('/api/user/:id', async (req: Request, res: Response) => {
  const user = await userService.findUserById(req.params.id as string);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

router.put('/api/user/:id/profile', async (req: Request, res: Response) => {
  try {
    const updated = await userService.updateUserProfile(req.params.id as string, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
