export const createIdGenerator = () => {
  let increment = 0;

  return () => {
    if (increment >= Number.MAX_SAFE_INTEGER) {
      increment = 0;
    }

    increment += 1;

    return `${Date.now()}_${Math.random()}_${increment}`;
  };
};
