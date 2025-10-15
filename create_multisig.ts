import * as multisig from "@sqds/multisig";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";

const { Permission, Permissions } = multisig.types;

interface MultisigSuccess {
  ok: true;
  multisigPda: string;
  tx: string;
  creator: string;
  member2: string;
}

interface MultisigError {
  ok: false;
  error: string;
}

type MultisigResult = MultisigSuccess | MultisigError;

export async function createSquadsMultisig(): Promise<MultisigResult> {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // Creator / fee payer
  const creator = Keypair.generate();

  // Fund the creator (devnet airdrop)
  try {
    const sig = await connection.requestAirdrop(
      creator.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig, "confirmed");
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, error: "Airdrop failed: " + error };
  }

  // createKey used to derive PDA and must sign
  const createKey = Keypair.generate();
  const [multisigPda] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
  });

  // Second member
  const secondMember = Keypair.generate();

  try {
    // Fetch Program Config to get treasury
    const [programConfigPda] = multisig.getProgramConfigPda({});
    const programConfig =
      await multisig.accounts.ProgramConfig.fromAccountAddress(
        connection,
        programConfigPda
      );

    // Send via SDK rpc helper (signers: creator, createKey)
    const signature = await multisig.rpc.multisigCreateV2({
      connection,
      createKey,
      creator,
      multisigPda,
      configAuthority: null,
      timeLock: 0,
      members: [
        { key: creator.publicKey, permissions: Permissions.all() },
        {
          key: secondMember.publicKey,
          permissions: Permissions.fromPermissions([Permission.Vote]),
        },
      ],
      threshold: 2,
      rentCollector: null,
      treasury: programConfig.treasury,
      sendOptions: { skipPreflight: true },
    });

    await connection.confirmTransaction(signature, "confirmed");

    return {
      ok: true,
      multisigPda: multisigPda.toBase58(),
      tx: signature,
      creator: creator.publicKey.toBase58(),
      member2: secondMember.publicKey.toBase58(),
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, error };
  }
}

// Allow direct execution for quick manual tests
// Check if this module is being run directly
import { fileURLToPath } from "url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createSquadsMultisig().then((res) => {
    console.log(JSON.stringify(res, null, 2));
  });
}
