export function createPostCoreSlideHandlers(deps) {
  return {
    'save': (env, actor, body) => deps.handleSaveAction(env, actor, body),
    'duplicate-slide': (env, actor, body) => deps.handleDuplicateSlideAction(env, actor, body),
    'duplicate-template': (env, actor, body) => deps.handleDuplicateTemplateAction(env, actor, body),
    'rename-slide': (env, actor, body) => deps.handleRenameSlideAction(env, actor, body),
    'delete-slide': (env, actor, body) => deps.handleDeleteSlideAction(env, actor, body),
  };
}
