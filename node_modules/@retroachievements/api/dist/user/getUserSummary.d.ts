import type { AuthObject } from "../utils/public";
import type { UserSummary } from "./models";
/**
 * A call to this function will retrieve summary information about
 * a given user, targeted by username.
 *
 * @param authorization An object containing your userName and webApiKey.
 * This can be constructed with `buildAuthorization()`.
 *
 * @param payload.userName The user for which to retrieve the summary for.
 *
 * @param payload.recentGamesCount Optional. The number of recent games to return.
 * This defaults to 5.
 *
 * @param payload.recentAchievementsCount Optional. The number of recent achievements
 * to return. This defaults to 5.
 *
 * @example
 * ```
 * const userSummary = await getUserSummary(
 *   authorization,
 *   { userName: "xelnia" }
 * );
 * ```
 *
 * @returns An object containing summary metadata about a target user.
 */
export declare const getUserSummary: (authorization: AuthObject, payload: {
    userName: string;
    recentGamesCount?: number;
    recentAchievementsCount?: number;
}) => Promise<UserSummary>;
