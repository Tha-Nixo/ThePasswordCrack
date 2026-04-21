import { Zone } from "../../shared/types";

export class PasswordEngine {
  private zones: Map<string, Zone> = new Map();

  /**
   * Complete password built by concatenating all zones,
   * sorted by their insertion order or a designated priority.
   * For simplicity here, we can sort by priority to ensure stable ordering.
   */
  getPassword(): string {
    const sortedZones = Array.from(this.zones.entries())
      .map(([name, zone]) => ({ name, ...zone }))
      .sort((a, b) => a.priority - b.priority);

    return sortedZones.map(z => z.content).join("");
  }

  getPasswordExcludingZone(excludeZoneName: string): string {
    const sortedZones = Array.from(this.zones.entries())
      .map(([name, zone]) => ({ name, ...zone }))
      .sort((a, b) => a.priority - b.priority);

    return sortedZones
      .filter(z => z.name !== excludeZoneName)
      .map(z => z.content)
      .join("");
  }

  setZoneContent(name: string, content: string): void {
    const zone = this.zones.get(name);
    if (zone && !zone.locked) {
      zone.content = content;
    }
  }

  setZone(name: string, content: string, priority: number, ruleDependencies: number[]): void {
    const existing = this.zones.get(name);
    if (existing && existing.locked) return;
    
    this.zones.set(name, {
      content,
      locked: false,
      priority,
      ruleDependencies
    });
  }

  getZone(name: string): Zone | undefined {
    return this.zones.get(name);
  }

  getAllZones(): Map<string, Zone> {
    return this.zones;
  }

  lockZone(name: string): void {
    const zone = this.zones.get(name);
    if (zone) zone.locked = true;
  }
}
