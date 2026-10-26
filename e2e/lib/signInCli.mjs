// Sign the dev map editor in and save the browser state (lib/editorAuth.mjs), as its
// own node process: the editor tests' fixture runs it right before each editor test,
// so the sign-in is fresh and happens outside the test runner's process, where no
// trace, report or step title can record the password. Prints only the reason on failure.

import { signInEditorOnce } from './editorAuth.mjs';

const problem = await signInEditorOnce();
if (problem) {
    console.error(problem);
    process.exit(1);
}
