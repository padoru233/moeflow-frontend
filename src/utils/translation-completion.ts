export interface TranslationCompletionPayload {
  project_id: string;
  project_name: string;
  chapter: string;
  action: 'translation_completed';
  operator: string;
  event_id: string;
  timestamp: number;
}

export interface TranslationCompletionPayloadInput {
  projectId: string;
  projectName: string;
  chapter: string;
  operator: string;
  eventId: string;
  timestamp: number;
}

export const buildTranslationCompletionPayload = ({
  projectId,
  projectName,
  chapter,
  operator,
  eventId,
  timestamp,
}: TranslationCompletionPayloadInput): TranslationCompletionPayload => ({
  project_id: projectId,
  project_name: projectName,
  chapter,
  action: 'translation_completed',
  operator,
  event_id: eventId,
  timestamp,
});
