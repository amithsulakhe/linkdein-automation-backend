/** Lightweight registry for tests and introspection (no LangChain imports). */
export function listChatToolNames() {
  return [
    'semanticDocumentSearch',
    'documentMetadata',
    'publishedPostHistory',
    'linkedInAnalyticsOverview',
    'contentCalendar',
    'draftPostSuggestion',
  ];
}

export function assertNoDestructiveChatTools(tools) {
  const forbidden = ['publishPost', 'approvePost', 'rejectPost', 'modifyCredentials'];
  for (const name of forbidden) {
    if (name in tools) {
      throw new Error(`Forbidden tool exposed: ${name}`);
    }
  }
}
