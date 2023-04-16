import type { AuthObject } from "../utils/public";
import type { ConsoleId } from "./models";
/**
 * A call to this function will retrieve the complete list
 * of console ID and name pairs on the RetroAchievements.org
 * platform.
 *
 * @param authorization An object containing your userName and webApiKey.
 * This can be constructed with `buildAuthorization()`.
 *
 * @example
 * ```
 * const consoleIds = await getConsoleIds(authorization);
 * ```
 *
 * @returns An array containing a complete list of console ID
 * and name pairs for RetroAchievements.org.
 * ```
 * { id: "1", name: "Mega Drive" }
 * ```
 */
export declare const getConsoleIds: (authorization: AuthObject) => Promise<ConsoleId[]>;
