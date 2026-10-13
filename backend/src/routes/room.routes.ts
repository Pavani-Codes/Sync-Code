import { Router } from 'express';
import { getOrCreateRoom, getUserRooms, deleteRoom } from '../controllers/room.controller.js';


const router = Router();

router.get('/user', getUserRooms);
router.post('/:roomId', getOrCreateRoom);
router.delete('/:roomId', deleteRoom);

export default router;