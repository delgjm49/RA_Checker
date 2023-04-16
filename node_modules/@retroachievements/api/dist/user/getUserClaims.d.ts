import type { AuthObject } from "../utils/public";
import type { UserClaims } from "./models";
/**
 * A call to this function will retrieve a list of
 * achievement set claims made over the lifetime of a given
 * user, targeted by their username.
 *
 * @param authorization An object containing your userName and webApiKey.
 * This can be constructed with `buildAuthorization()`.
 *
 * @param payload.userName The user for which to retrieve the historical
 * achievement set claims list for.
 *
 * @example
 * ```
 * const userClaims = await getUserClaims(
 *   authorization,
 *   { userName: "Jamiras" }
 * );
 * ```
 *
 * @returns An array containing all the achievement set claims
 * made over the lifetime of the given user.
 */
export declare const getUserClaims: (authorization: AuthObject, payload: {
    userName: string;
}) => Promise<UserClaims>;
