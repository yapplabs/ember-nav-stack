import RSVP from 'rsvp';

export default function delay(ms) {
  return new RSVP.Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}
