import { AnchorProvider, BN, Program, Wallet, utils } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idl from '../../target/idl/spotwin.json';

type SpotwinIdl = any;

export class SpotwinClient {
  public readonly connection: Connection;
  public readonly wallet: Wallet;
  public readonly program: Program<SpotwinIdl>;
  public readonly provider: AnchorProvider;

  constructor(
    wallet: Wallet, 
    connection: Connection, 
    programId = new PublicKey(idl.address) 
  ) {
    this.wallet = wallet;
    this.connection = connection;
    this.provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
    this.program = new Program(idl as SpotwinIdl, this.provider);
  }

  pdaContest(contestId: BN): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("contest"), contestId.toArrayLike(Buffer, "le", 8)],
      this.program.programId
    )[0];
  }

  pdaVault(contestId: BN): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), contestId.toArrayLike(Buffer, "le", 8)],
      this.program.programId
    )[0];
  }

  pdaVaultAuthority(contestId: BN): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault_authority"), contestId.toArrayLike(Buffer, "le", 8)],
      this.program.programId
    )[0];
  }

  pdaParticipant(contestId: BN, player: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("participant"), 
        contestId.toArrayLike(Buffer, "le", 8),
        player.toBuffer()
      ],
      this.program.programId
    )[0];
  }

  async createContest(contestId: BN, entryFee: BN, lockSlot: BN, poolMint: PublicKey): Promise<string> {
    try {
      const contestPda = this.pdaContest(contestId);
      const vaultPda = this.pdaVault(contestId);
      const vaultAuthorityPda = this.pdaVaultAuthority(contestId);

      return await this.program.methods
        .createContest(contestId, entryFee, lockSlot)
        .accountsStrict({
          contest: contestPda,
          creator: this.wallet.publicKey,
          vault: vaultPda,
          vaultAuthority: vaultAuthorityPda,
          poolMint: poolMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
    } catch (error) {
      console.error("Error in SpotwinClient.createContest:", error);
      throw error;
    }
  }

  async joinContest(contestId: BN, playerTokenAccount: PublicKey, poolMint: PublicKey): Promise<string> {
    try {
      const contestPda = this.pdaContest(contestId);
      const vaultPda = this.pdaVault(contestId);
      const vaultAuthorityPda = this.pdaVaultAuthority(contestId);
      const participantPda = this.pdaParticipant(contestId, this.wallet.publicKey);

      return await this.program.methods
        .joinContest(contestId)
        .accountsStrict({
          player: this.wallet.publicKey,
          contest: contestPda,
          participant: participantPda,
          vault: vaultPda,
          vaultAuthority: vaultAuthorityPda, 
          playerToken: playerTokenAccount,
          poolMint: poolMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
    } catch (error) {
      console.error("Error in SpotwinClient.joinContest:", error);
      throw error;
    }
  }

  async updateAnswers(contestId: BN, newAnswerBits: number, newAttemptMask: number): Promise<string> {
    try {
      const contestPda = this.pdaContest(contestId);
      const participantPda = this.pdaParticipant(contestId, this.wallet.publicKey);

      return await this.program.methods
        .updateAnswers(newAnswerBits, newAttemptMask) 
        .accountsStrict({
          player: this.wallet.publicKey,
          contest: contestPda,
          participant: participantPda,
          systemProgram: SystemProgram.programId, 
        })
        .rpc();
    } catch (error) {
      console.error("Error in SpotwinClient.updateAnswers:", error);
      throw error;
    }
  }

  async lockContest(contestId: BN): Promise<string> {
    try {
      const contestPda = this.pdaContest(contestId);

      return await this.program.methods
        .lockContest(contestId)
        .accountsStrict({
          admin: this.wallet.publicKey, 
          contest: contestPda,
          systemProgram: SystemProgram.programId, 
        })
        .rpc();
    } catch (error) {
      console.error("Error in SpotwinClient.lockContest:", error);
      throw error;
    }
  }

  async postAnswers(contestId: BN, correctAnswersBits: number): Promise<string> {
    try {
      const contestPda = this.pdaContest(contestId);

      return await this.program.methods
        .postAnswers(contestId, correctAnswersBits)
        .accountsStrict({
          admin: this.wallet.publicKey, 
          contest: contestPda,
          systemProgram: SystemProgram.programId, 
        })
        .rpc();
    } catch (error) {
      console.error("Error in SpotwinClient.postAnswers:", error);
      throw error;
    }
  }

  async sendBatch(
    contestId: BN, 
    poolMint: PublicKey, 
    participantInfos: Array<{ participantPda: PublicKey; playerTokenAccount: PublicKey }>
  ): Promise<string> {
    try {
      const contestPda = this.pdaContest(contestId);
      const vaultPda = this.pdaVault(contestId);
      const vaultAuthorityPda = this.pdaVaultAuthority(contestId);

      const remainingAccounts = participantInfos.flatMap(info => [
        { pubkey: info.participantPda, isSigner: false, isWritable: true },
        { pubkey: info.playerTokenAccount, isSigner: false, isWritable: true },
      ]);

      return await this.program.methods
        .sendBatch(contestId) 
        .accountsStrict({
          admin: this.wallet.publicKey, 
          contest: contestPda,
          vault: vaultPda,
          vaultAuthority: vaultAuthorityPda,
          poolMint: poolMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .rpc();
    } catch (error) {
      console.error("Error in SpotwinClient.sendBatch:", error);
      throw error;
    }
  }
}