import Ember from 'ember';
const { testing } = Ember;
import { Promise, animate } from 'liquid-fire';

const duration = testing ? 0 : 330;
const easing = [.23, 1, .32, 1];

export default function(direction, opts = { duration, easing }) {
  // let distanceOut = this.newElement.width() / 8;
  let distanceOut = 60;
  let distanceIn = distanceOut;
  if (direction === 'left') {
    distanceOut *= -1;
  } else {
    distanceIn *= -1;
  }
  return Promise.all([
    animate(this.oldElement, {
      opacity: 0,
      translateX: [`${distanceOut}px`]
    }, opts),
    animate(this.newElement, {
      opacity: 1,
      translateX: ['0px', `${distanceIn}px`]
    }, opts)
  ]);
}
