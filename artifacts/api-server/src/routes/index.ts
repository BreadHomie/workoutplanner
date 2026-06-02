import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profileRouter from "./profile";
import exercisesRouter from "./exercises";
import workoutsRouter from "./workouts";
import sessionsRouter from "./sessions";
import scheduleRouter from "./schedule";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profileRouter);
router.use(exercisesRouter);
router.use(workoutsRouter);
router.use(sessionsRouter);
router.use(scheduleRouter);

export default router;
