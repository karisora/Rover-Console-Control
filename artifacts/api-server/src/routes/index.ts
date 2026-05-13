import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roverRouter from "./rover";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roverRouter);

export default router;
