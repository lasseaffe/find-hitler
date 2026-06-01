// src/lib/speedrunHubs.js
// 5 curated start pages per target, each reachable within 4 clicks.
const HUBS = {
  'Adolf Hitler': [
    'Nazi Party', 'Weimar Republic', 'Third Reich', 'World War II', 'German nationalism',
  ],
  'Jesus': [
    'Christianity', 'Bible', 'New Testament', 'Messiah', 'Roman Empire',
  ],
  'Joseph Stalin': [
    'Soviet Union', 'Communist Party of the Soviet Union', 'Russian Revolution',
    'Bolshevik', 'Cold War',
  ],
  '9/11 attacks': [
    'Al-Qaeda', 'Terrorism', 'United States', 'George W. Bush', 'War on Terror',
  ],
  'Taylor Swift': [
    'Pop music', 'Billboard Hot 100', 'Country music', 'Grammy Award', 'American singer',
  ],
  'Black hole': [
    'General relativity', 'Astrophysics', 'Albert Einstein', 'Neutron star', 'Stephen Hawking',
  ],
  'Minecraft': [
    'Video game', 'Mojang', 'Sandbox game', 'Java (programming language)', 'Microsoft',
  ],
  'Holocaust': [
    'Nazi Germany', 'World War II', 'Adolf Hitler', 'Antisemitism', 'Concentration camp',
  ],
}

// Fallback list used when target has no curated hubs
const FALLBACK = ['History', 'Science', 'Geography', 'Politics', 'Culture']

export function getSpeedrunHubs(target) {
  return HUBS[target] || FALLBACK
}
