// Config dinámica sobre app.json. Permite que la build de DESARROLLO tenga un
// identificador y nombre distintos, para que conviva en el iPhone con la de
// producción/TestFlight (en iOS, mismo identificador = misma app, se sustituyen).
// La variante de desarrollo se activa con APP_VARIANT=development (definido en
// eas.json para el perfil "development").
const IS_DEV = process.env.APP_VARIANT === 'development';

export default ({ config }) => ({
  ...config,
  name: IS_DEV ? 'AccessBus Dev' : config.name,
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV ? 'com.jmortizsilva.busmadrid.dev' : config.ios.bundleIdentifier,
  },
});
