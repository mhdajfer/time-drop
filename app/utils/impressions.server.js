import { addImpressions } from "../models/timer.server";
import { createImpressionBuffer } from "./impression-buffer";

export const impressions = createImpressionBuffer({ save: addImpressions });
