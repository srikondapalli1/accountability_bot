export const SOCIAL_CHALLENGES = [
  'Join a local NYC run club this week — check Strava or Meetup for a Thursday evening group run.',
  'Host a small drinks night with your roommate and invite one acquaintance you have not seen in a month.',
  'Reach out to one college friend who lives in NYC and suggest grabbing coffee this weekend.',
  'Attend a free gallery opening or museum evening in Chelsea or the Lower East Side.',
  'Sign up for a beginner salsa or bachata class in Midtown — go solo, leave with one new conversation.',
  'Explore a new neighborhood bar in Williamsburg or Astoria and strike up one conversation with a stranger.',
  'Find a board game night at a local café and show up alone — that is the point.',
  'Volunteer for a single shift at a community event this week and talk to at least two people.',
  'Invite one work colleague (outside your usual two) to lunch near the office.',
  'Go to a comedy open mic in the East Village and sit at the bar instead of a corner table.',
];

export function pickRandomChallenge() {
  return SOCIAL_CHALLENGES[Math.floor(Math.random() * SOCIAL_CHALLENGES.length)];
}
