import { DOC_SCHEMAS, type DocType } from "./schema";
import { validateExercise, validatePage, validatePose, validateProgram, type DocMeta, type Issue } from "./validate";

/** Schema + editorial completeness issues for any document type (used by admin UI and publish). */
export function issuesFor(type: DocType, doc: unknown, meta: DocMeta): Issue[] {
  const parsed = DOC_SCHEMAS[type].safeParse(doc);
  if (!parsed.success) return parsed.error.issues.map((i) => ({ level: "error", field: i.path.join("."), code: i.message }));
  switch (type) {
    case "pose":
      return validatePose(parsed.data as never, meta);
    case "program":
      return validateProgram(parsed.data as never, meta);
    case "exercise":
      return validateExercise(parsed.data as never);
    default:
      return validatePage(parsed.data as never);
  }
}

