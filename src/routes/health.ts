import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { createENSServiceFromEnv } from '../services/ens.service.js';

/**
 * Health check route
 */
const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Health check',
        description: 'Check if the API is running',
        response: {
          200: Type.Object({
            status: Type.String(),
            timestamp: Type.String(),
            uptime: Type.Number(),
          }),
        },
      },
    },
    async (request, reply) => {
      

      // async function test() {
      //   const service = createENSServiceFromEnv();
        
      //   console.log('Chain Info:', service.getChainInfo());
        
      //   // Test creating a subname
      //   const result = await service.createSubname({
      //     label: 'test' + Date.now(),
      //     targetAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      //   });
      //     // const resultUnwrapped = await service.createEnsSubname_Unwrapped({
      //     //   label: 'test' + Date.now(),
      //     //   targetAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      //     // });
        
        
      //   console.log('Created:', result.subname);
        
      //   // Wait a bit for transaction to be mined
      //   await new Promise(resolve => setTimeout(resolve, 5000));
        
      //   // Test resolving
      //   const resolved = await service.resolveAddress(result.subname);
      //   console.log('Resolves to:', resolved);
      // }

      // test().catch(console.error);
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    }
  );
};

export default healthRoutes;
