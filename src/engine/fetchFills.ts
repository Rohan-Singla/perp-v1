import { getUserFills } from "./lib";

export async function fetchFills(userId: string) {
    return getUserFills(userId);
}
