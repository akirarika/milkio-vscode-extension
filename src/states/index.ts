import { ref } from "@vue/reactivity";
import { CookbookOptions } from "../utils/cookbook-dto-types";

export const states = ref({
  /**
   * Is the extension enabled?
   * Extensions are only enabled when there is only one workspace and it is a cookbook project
   */
  extensionEnable: false,
  /**
   * The current working directory
   */
  cwd: undefined as unknown as string,
  /**
   * The parsed cookbook.toml
   */
  cookbookToml: undefined as unknown as CookbookOptions,
});
