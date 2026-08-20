const scopedTag = (scope: string, churchId: string) => `${scope}:${churchId}`;

export const cacheTags = {
  initialRegistration: "initial-registration",
  church: (churchId: string) => scopedTag("church", churchId),
  organization: (churchId: string) => scopedTag("organization", churchId),
  regions: (churchId: string) => scopedTag("regions", churchId),
  congregations: (churchId: string) => scopedTag("congregations", churchId),
  roles: (churchId: string) => scopedTag("roles", churchId),
  memberFilters: (churchId: string) => scopedTag("member-filters", churchId),
  documentReferences: (churchId: string) => scopedTag("document-references", churchId),
  documentStats: (churchId: string) => scopedTag("document-stats", churchId),
  appSettings: (churchId: string) => scopedTag("app-settings", churchId),
  events: (churchId: string) => scopedTag("events", churchId),
  event: (churchId: string, eventId: string) => `event:${churchId}:${eventId}`,
  eventRegistrations: (churchId: string, eventId: string) => `event-registrations:${churchId}:${eventId}`,
  eventPayments: (churchId: string, eventId: string) => `event-payments:${churchId}:${eventId}`,
  eventCheckins: (churchId: string, eventId: string) => `event-checkins:${churchId}:${eventId}`,
  eventDocuments: (churchId: string, eventId: string) => `event-documents:${churchId}:${eventId}`,
  publicEvent: (publicCode: string) => `public-event:${publicCode}`,
} as const;
