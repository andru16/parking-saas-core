import mongoose from 'mongoose';
import env from '#config/env.js';

mongoose.set('strictQuery', true);

const registerConnectionEvents = () => {
  mongoose.connection.on('connected', () => {
    console.log(`MongoDB conectado — base de datos: ${mongoose.connection.name}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB desconectado');
  });

  mongoose.connection.on('error', (error) => {
    console.error('Error en la conexión MongoDB:', error.message);
  });
};

/**
 * Establece la conexión con MongoDB utilizando la configuración del entorno.
 * @param {string} [uri] — override (tests / memory server)
 */
export const connectDatabase = async (uri = process.env.MONGODB_URI ?? env.mongodb.uri) => {
  registerConnectionEvents();

  try {
    await mongoose.connect(uri, env.mongodb.options);
  } catch (error) {
    console.error('Error al conectar con MongoDB:', error.message);
    throw error;
  }
};

/**
 * Cierra la conexión de forma segura (útil para tests y shutdown).
 */
export const disconnectDatabase = async () => {
  await mongoose.disconnect();
};

export default mongoose;
