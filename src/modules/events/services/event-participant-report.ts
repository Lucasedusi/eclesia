import type {
  EventParticipantReportConfig,
  EventParticipantReportRow,
  EventParticipantReportSource,
} from "../types/event.types";

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

function compareNullableNames(first: string | null, second: string | null) {
  if (first === second) return 0;
  if (!first) return 1;
  if (!second) return -1;
  return collator.compare(first, second);
}

function congregationAndRegion(row: EventParticipantReportSource) {
  const congregation = row.congregationName ?? "Sem congregação";
  const region = row.regionName ?? "Sem regional";
  return `${congregation} - ${region}`;
}

export function organizeEventParticipants(
  rows: EventParticipantReportSource[],
  config: EventParticipantReportConfig,
): EventParticipantReportRow[] {
  const ordered = [...rows].sort((first, second) => {
    if (config.organization === "ALPHABETICAL") {
      return collator.compare(first.participantName, second.participantName)
        || compareNullableNames(first.congregationName, second.congregationName)
        || collator.compare(first.id, second.id);
    }

    return first.regionDisplayOrder - second.regionDisplayOrder
      || compareNullableNames(first.regionName, second.regionName)
      || first.congregationDisplayOrder - second.congregationDisplayOrder
      || compareNullableNames(first.congregationName, second.congregationName)
      || collator.compare(first.participantName, second.participantName)
      || collator.compare(first.id, second.id);
  });

  return ordered.map((row, index) => ({
    ...row,
    index: index + 1,
    congregationAndRegion: congregationAndRegion(row),
  }));
}
