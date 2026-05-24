import { Router, type IRouter } from "express";
import designAiRouter from "./designAi";
import healthRouter from "./health";
import roverRouter from "./rover";

const router: IRouter = Router();

router.use(designAiRouter);
router.use(healthRouter);
router.use(roverRouter);

export default router;
