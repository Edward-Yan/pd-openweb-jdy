export const envConfig = {
  development: {
    domainName: 'https://jdy.crecg-jt.com:3443',
  },
  test: {
    domainName: 'http://10.39.29.108:8880',
  },
  production: {
    domainName: 'https://jdy.crecg-jt.com:3443',
  },
};

export const getEnvConfig = () => {
  const env = process.env.NODE_ENV;
  // const env = 'test';
  console.log('envenvenvenv', env);
  return envConfig[env];
};
