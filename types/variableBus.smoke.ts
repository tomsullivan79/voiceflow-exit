// types/variableBus.smoke.ts
import { createEmptyBus, mapSpeciesMetaToFlags, VariableBus } from '@/types/variableBus';

// Instantiate a triage bus to ensure types and paths resolve:
const bus: VariableBus = createEmptyBus('triage');

// Simulate species_meta mapping to flags (osprey-like example)
const flags = mapSpeciesMetaToFlags({
  dangerous: true,
  rabies_vector: false,
  referral_required: true,
  intervention_needed: 'always',
  after_hours_allowed: false,
});

// Assign back to the bus (type should match)
bus.species_flags = flags;

// Keep this file in the repo as a static typecheck. No runtime usage needed.
export default bus;
