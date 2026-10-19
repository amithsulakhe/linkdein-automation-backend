export const CONTENT_PRESETS = [
  {
    id: 'javascript',
    label: 'JavaScript & web engineering',
    brief:
      'Practical posts for software developers about JavaScript, TypeScript, React, Node.js, performance, and clean engineering.',
  },
  {
    id: 'career',
    label: 'Developer career',
    brief:
      'Posts about software careers: interviews, resumes, promotions, communication, and lessons from building a career in tech.',
  },
  {
    id: 'ai',
    label: 'AI for engineers',
    brief:
      'Posts about using AI in real engineering work: prompting, evaluation, agents, cost, and what actually ships.',
  },
  {
    id: 'leadership',
    label: 'Engineering leadership',
    brief:
      'Posts for engineering managers and senior ICs about teams, reviews, planning, and technical decision making.',
  },
  {
    id: 'custom',
    label: 'Custom',
    brief: '',
  },
];

export function resolveContentBrief(preferences = {}) {
  const preset = CONTENT_PRESETS.find((item) => item.id === preferences.contentType);
  if (preferences.contentType === 'custom') {
    return preferences.contentBrief?.trim() || 'Professional LinkedIn posts for the user’s audience.';
  }
  return preferences.contentBrief?.trim() || preset?.brief || CONTENT_PRESETS[0].brief;
}
