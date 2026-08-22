/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schema
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

// The Standard Schema v1 interface, declared structurally rather than imported: any conforming library, such as
// zod, valibot or arktype, is accepted without orderly depending on any of them. The user's schema library is
// the user's dependency.
export interface StandardSchema<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaProperties<Input, Output>;
}

/*****************************************************************************************************************/

export interface StandardSchemaProperties<Input = unknown, Output = Input> {
  // The version of the specification the schema implements.
  readonly version: 1;
  // The name of the library the schema comes from.
  readonly vendor: string;
  // Validates a value, synchronously or not, returning the parsed output or the issues found.
  readonly validate: (
    value: unknown,
  ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
  // Carries the inferred types; never present at runtime.
  readonly types?: { readonly input: Input; readonly output: Output } | undefined;
}

/*****************************************************************************************************************/

export type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: readonly StandardSchemaIssue[] };

/*****************************************************************************************************************/

export interface StandardSchemaIssue {
  readonly message: string;
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined;
}

/*****************************************************************************************************************/
