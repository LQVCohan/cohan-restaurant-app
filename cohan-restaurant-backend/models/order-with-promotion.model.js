import Order from "./order.model.js";
import { installOrderPromotionPersistence } from "../src/services/orderPromotionPersistence.service.js";

export default installOrderPromotionPersistence(Order);
