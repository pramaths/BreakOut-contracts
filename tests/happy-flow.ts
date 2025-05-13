import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID,
    getAccount,
    Account as TokenAccount
} from "@solana/spl-token";
import { Spotwin } from "../target/types/spotwin";

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
describe('happy-flow', () => {
    anchor.setProvider(anchor.AnchorProvider.env());
    const program = anchor.workspace.Spotwin as Program<Spotwin>;

    const provider = anchor.getProvider() as anchor.AnchorProvider;
    const payer = provider.wallet as anchor.Wallet;

    let usdcMint: anchor.web3.PublicKey;
    let contestPda: anchor.web3.PublicKey;
    let vaultPda: anchor.web3.PublicKey;
    let vaultAuth: anchor.web3.PublicKey;
    let participantPda: anchor.web3.PublicKey;
    let contestBump: number;
    let vaultBump: number;
    let vaultAuthBump: number;
    const contestId = new BN(Date.now());
    const contestIdBuffer = contestId.toArrayLike(Buffer, "le", 8);
    const entryFee = new BN(1_000_000);
    let lockSlot: BN;
    let stakeVaultPda: anchor.web3.PublicKey;
    let stakeAuthorityPda: anchor.web3.PublicKey;

    it('initialize a contest PDA and vault', async () => {
        usdcMint = await createMint(
            provider.connection,
            payer.payer,
            payer.publicKey,
            null,
            6,
        )
        console.log("USDC Mint created:", usdcMint.toBase58());

        [contestPda, contestBump] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from("contest"),
                contestIdBuffer
            ],
            program.programId,
        )

        console.log("contestPda", contestPda.toBase58(), "Bump:", contestBump);

        [vaultPda, vaultBump] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from("vault"),
                contestIdBuffer,
                usdcMint.toBuffer()
            ],
            program.programId,
        )
        console.log("vaultPda", vaultPda.toBase58());

        lockSlot = new BN((await provider.connection.getSlot() + 100));

        [vaultAuth, vaultAuthBump] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("vault_authority"), contestIdBuffer],
            program.programId
        );
        console.log("vaultAuth", vaultAuth.toBase58());

        stakeVaultPda = anchor.web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from("stake_vault"),
            ],
            program.programId,
        )[0];
        console.log("stakeVaultPda", stakeVaultPda.toBase58());

        stakeAuthorityPda = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("stake_vault_auth")],
            program.programId
        )[0];
        console.log("stakeAuthorityPda", stakeAuthorityPda.toBase58());

        const tx = await program.methods
            .createContest(contestId, entryFee, lockSlot)
            .accountsStrict({
                contest: contestPda,
                creator: payer.publicKey,
                vault: vaultPda,
                vaultAuthority: vaultAuth,
                poolMint: usdcMint,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([payer.payer])
            .rpc();
        console.log("Create contest tx:", tx);
        await provider.connection.confirmTransaction(tx, "confirmed");

        const contest = await program.account.contest.fetch(contestPda);
        console.log("Contest vault address:", vaultPda.toBase58());
        console.log("Contest account fetched:", contest);

        const vaultTokenAccount = await getAccount(provider.connection, vaultPda);
        console.log("Vault Token Account Info:", vaultTokenAccount);

        assert.ok(contest.creator.equals(payer.publicKey));
        assert.equal(contest.entryFee.toString(), entryFee.toString());
        assert.equal(contest.lockSlot.toString(), lockSlot.toString());
        assert.equal(contest.totalEntries, 0);
        assert.ok(contest.status.hasOwnProperty('open'));
        assert.ok(contest.poolMint.equals(usdcMint));

        const vaultInfo = await getAccount(
            provider.connection,
            vaultPda,
        )
        console.log("Vault account fetched:", vaultInfo);
        assert.ok(vaultInfo.mint.equals(usdcMint));
        assert.ok(vaultInfo.owner.equals(vaultAuth));
        assert.equal(Number(vaultInfo.amount), 0);
    })

    it('join a contest', async () => {
        assert.ok(usdcMint, "USDC Mint should be initialized");
        assert.ok(contestPda, "Contest PDA should be initialized");
        assert.ok(vaultPda, "Vault PDA should be initialized");
        assert.ok(vaultAuth, "Vault Auth PDA should be initialized");

        const playerTokenAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer.payer,
            usdcMint,
            payer.publicKey
        );
        console.log("Player token account:", playerTokenAccount.address.toBase58());

        const mintAmount = new BN(100 * 1_000_000);
        await mintTo(
            provider.connection,
            payer.payer,
            usdcMint,
            playerTokenAccount.address,
            payer.payer,
            BigInt(mintAmount.toString())
        );
        console.log(`Minted ${mintAmount} tokens to player account`);

        const playerBalanceBefore = await provider.connection.getTokenAccountBalance(playerTokenAccount.address);
        assert.equal(playerBalanceBefore.value.amount, mintAmount.toString());

        // Correctly assign to the describe-scoped participantPda
        [participantPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from("participant"),
                contestIdBuffer,
                payer.publicKey.toBuffer()
            ],
            program.programId
        );
        console.log("Participant PDA:", participantPda.toBase58());

        const joinTx = await program.methods
            .joinContest(contestId)
            .accountsStrict({
                player: payer.publicKey,
                contest: contestPda,
                participant: participantPda,
                vault: vaultPda,
                vaultAuthority: vaultAuth,
                playerToken: playerTokenAccount.address,
                poolMint: usdcMint,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([payer.payer])
            .rpc();

        console.log("Join contest tx:", joinTx);
        await provider.connection.confirmTransaction(joinTx, "confirmed");

        const contestAfter = await program.account.contest.fetch(contestPda);
        console.log("Contest account after join:", contestAfter);
        assert.equal(contestAfter.totalEntries, 1, "Total entries should be 1");

        const participant = await program.account.participant.fetch(participantPda);
        console.log("Participant account:", participant);
        assert.ok(participant.player.equals(payer.publicKey), "Participant player should match payer");
        assert.equal(participant.attemptMask, 0, "Initial attempt mask should be 0");
        assert.equal(participant.answerBits, 0, "Initial answer bits should be 0");

        const vaultInfoAfter = await getAccount(provider.connection, vaultPda);
        console.log("Vault account after join:", vaultInfoAfter);
        assert.equal(vaultInfoAfter.amount.toString(), entryFee.toString(), "Vault balance should increase by entry fee");

        const playerBalanceAfter = await provider.connection.getTokenAccountBalance(playerTokenAccount.address);
        const expectedPlayerBalance = mintAmount.sub(entryFee);
        console.log(`Player balance after: ${playerBalanceAfter.value.amount}, Expected: ${expectedPlayerBalance.toString()}`)
        assert.equal(playerBalanceAfter.value.amount, expectedPlayerBalance.toString(), "Player balance should decrease by entry fee");
    })

    // Constants for the new test scenario
    const NUM_TOTAL_QUESTIONS = 12;
    const NUM_ANSWERED_QUESTIONS = 9;

    // User answers 9 questions. For simplicity, let's say they answer Q0-Q8 as '1'.
    // Correct answers for all 12 questions. Example: Q0-Q8 are '1', Q9='0', Q10='1', Q11='0'.
    // This means user got all 9 of their answered questions correct.
    // Correct answers bitmask: (Q0-8 are '1') OR (Q10 is '1')
    // Binary: 0b010111111111 (Q11=0, Q10=1, Q9=0, Q0-Q8=1)
    // Note: Bitmask construction logic might need adjustment based on LSB/MSB ordering in your program.
    // Assuming LSB is Q0: ((1 << NUM_ANSWERED_QUESTIONS) - 1) covers Q0 to Q8.
    // Then OR with (1 << (NUM_TOTAL_QUESTIONS - 2)) for Q10 (since Q11 is highest, Q10 is second highest bit index).
    const correctAnswersBitmask = new BN(((1 << NUM_ANSWERED_QUESTIONS) - 1)).or(new BN(1 << (NUM_TOTAL_QUESTIONS - 2)));
    console.log(`Correct answers bitmask: 0b${correctAnswersBitmask.toString(2)}`);

    it('user submits answers to 9 out of 12 questions', async () => {
        assert.ok(contestPda, "Contest PDA should be initialized");
        assert.ok(participantPda, "Participant PDA should be initialized");

        // User attempts and answers the first 9 questions.
        // Example: attemptMask for first 9 questions = (2^9) - 1 = 0x1FF (binary 111111111)
        // Example: answerBits for first 9 questions (user answers '1' for all) = (2^9) - 1 = 0x1FF
        const attemptMask = new BN((1 << NUM_ANSWERED_QUESTIONS) - 1);
        const answerBits = new BN((1 << NUM_ANSWERED_QUESTIONS) - 1);
        console.log(`User attempts bitmask: 0b${attemptMask.toString(2)}`);
        console.log(`User answers bitmask: 0b${answerBits.toString(2)}`);

        console.log(`Submitting answers: attemptMask=0b${attemptMask.toString(2)}, answerBits=0b${answerBits.toString(2)}`);

        const tx = await program.methods
            .updateAnswers(contestId, answerBits.toNumber(), attemptMask.toNumber())
            .accountsStrict({
                player: payer.publicKey,
                contest: contestPda,
                participant: participantPda,
            })
            .signers([payer.payer])
            .rpc();

        console.log("Submit answers tx:", tx);
        await provider.connection.confirmTransaction(tx, "confirmed");

        const participantAfter = await program.account.participant.fetch(participantPda);
        console.log("Participant account after submitting answers:", participantAfter);
        assert.equal(participantAfter.attemptMask.toString(), attemptMask.toString(), "Attempt mask should be updated");
        assert.equal(participantAfter.answerBits.toString(), answerBits.toString(), "Answer bits should be updated");
        // Add assertions for any other state changes in the participant account if applicable
    });

    it('admin locks the contest', async () => {
        assert.ok(contestPda, "Contest PDA should be initialized");

        // Ensure current slot is past the lock_slot for the test to be meaningful in a real scenario
        // For this test, we assume lock_slot was set appropriately during contest creation.
        // Or, if your lock_contest instruction doesn't check current slot vs lock_slot (e.g., allows early lock by admin),
        // then this check might not be strictly needed here, but it's good practice.
        const contestAccountBefore = await program.account.contest.fetch(contestPda);
        const currentSlot = await provider.connection.getSlot();
        console.log(`Current slot: ${currentSlot}, Contest lock slot: ${contestAccountBefore.lockSlot.toString()}`);
        // If you want to strictly test the slot condition, you might need to advance slots or adjust lock_slot.
        // For now, we'll proceed assuming the admin can lock it.

        const tx = await program.methods
            .lockContest(contestId) // Assumed method name
            .accountsStrict({
                creator: payer.publicKey, // Assuming the payer is the creator/admin
                contest: contestPda,
            })
            .signers([payer.payer])
            .rpc();

        console.log("Lock contest tx:", tx);
        await provider.connection.confirmTransaction(tx, "confirmed");

        const contestAccountAfter = await program.account.contest.fetch(contestPda);
        console.log("Contest account after locking:", contestAccountAfter);
        assert.ok(contestAccountAfter.status.hasOwnProperty('locked'), "Contest status should be locked");
        // Add assertions for any other state changes in the contest account if applicable
    });

    it('admin posts correct answers', async () => {
        assert.ok(contestPda, "Contest PDA should be initialized");

        const contestAccountBefore = await program.account.contest.fetch(contestPda);
        assert.ok(contestAccountBefore.status.hasOwnProperty('locked'), "Contest must be locked before posting answers");

        console.log(`Posting answers with bitmask: 0b${correctAnswersBitmask.toString(2)} (decimal: ${correctAnswersBitmask.toString()})`);

        const tx = await program.methods
            .postAnswerKey(contestId, correctAnswersBitmask.toNumber()) // FIX (9a5afc9a-4984-447f-8de9-9b657dcfd74b): Convert BN to number
            .accountsStrict({
                creator: payer.publicKey, // Assuming the payer is the creator/admin
                contest: contestPda,
            })
            .signers([payer.payer])
            .rpc();

        console.log("Post answers tx:", tx);
        await provider.connection.confirmTransaction(tx, "confirmed");

        const contestAccountAfter = await program.account.contest.fetch(contestPda);
        console.log("Contest account after posting answers:", contestAccountAfter);
        assert.ok(contestAccountAfter.status.hasOwnProperty('answerKeyPosted'), "Contest status should be answerKeyPosted");
        assert.equal(contestAccountAfter.answerKey, correctAnswersBitmask.toNumber(), "Answer key should be set correctly"); // FIX (f189e2f9-19f8-4104-af6c-b7ca59f3647e): Compare number with number
        // Add assertions for any other state changes in the contest account if applicable
    });

    it('sends batch rewards to a winner', async () => {
        // 0. Prerequisites check
        assert.ok(usdcMint, "USDC Mint should be initialized");
        assert.ok(contestPda, "Contest PDA should be initialized");
        assert.ok(vaultPda, "Vault PDA should be initialized");
        assert.ok(vaultAuth, "Vault Auth PDA should be initialized");
        // participantPda is for 'payer' who joined the contest earlier
        assert.ok(participantPda, "Participant PDA for payer (winner) should be initialized");

        const contestAccountBefore = await program.account.contest.fetch(contestPda);
        assert.ok(contestAccountBefore.status.hasOwnProperty('answerKeyPosted'), "Contest must have answer key posted to send batch.");
        const vaultTokenAccountBefore = await getAccount(provider.connection, vaultPda);
        const initialPaidSoFar = contestAccountBefore.paidSoFar;

        // 1. Define Winner(s) and Amounts
        const winner1 = payer.publicKey; // 'payer' is our winner
        // Vault has at least entryFee from payer's join. Send half of it back.
        const amountToSend1 = new BN(entryFee.toNumber() / 2);
        console.log(`Attempting to send ${amountToSend1.toString()} to winner ${winner1.toBase58()}`);
        assert(BigInt(vaultTokenAccountBefore.amount.toString()) >= BigInt(amountToSend1.toString()), "Vault does not have enough funds to send the specified amount.");

        // 2. Prepare ATAs and Participant PDAs for remainingAccounts
        const winner1ParticipantPda = participantPda; // participantPda was derived for 'payer'
        const winner1Ata = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer.payer, // fee payer for ATA creation if needed
            usdcMint,
            winner1      // owner of the ATA
        );
        const winner1AtaBalanceBefore = (await getAccount(provider.connection, winner1Ata.address)).amount;
        console.log(`Winner1 ATA: ${winner1Ata.address.toBase58()}, balance before: ${winner1AtaBalanceBefore.toString()}`);

        // 3. Construct remainingAccounts array
        // Order: Participant PDAs first, then Winner ATAs
        const remainingAccountsList = [
            { pubkey: winner1ParticipantPda, isSigner: false, isWritable: false }, // Participant PDA for winner1
            { pubkey: winner1Ata.address, isSigner: false, isWritable: true },    // ATA for winner1 (receives funds)
        ];

        const winnersArray = [winner1];
        const amountsArray = [amountToSend1];

        // 4. Call sendBatch
        console.log("Calling sendBatch instruction...");
        const txSignature = await program.methods
            .sendBatch(contestId, winnersArray, amountsArray)
            .accountsStrict({
                creator: payer.publicKey,
                contest: contestPda,
                vault: vaultPda,
                vaultAuthority: vaultAuth,
                poolMint: usdcMint,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .remainingAccounts(remainingAccountsList)
            .signers([payer.payer]) // Creator (payer in this test) signs
            .rpc();

        console.log("Send batch transaction signature:", txSignature);
        await provider.connection.confirmTransaction(txSignature, "confirmed");
        console.log("Transaction confirmed.");

        // 5. Assertions
        const contestAccountAfter = await program.account.contest.fetch(contestPda);
        const expectedPaidSoFar = initialPaidSoFar.add(amountToSend1);
        assert.equal(contestAccountAfter.paidSoFar.toString(), expectedPaidSoFar.toString(), "Contest 'paidSoFar' should be updated correctly.");

        const vaultTokenAccountAfter = await getAccount(provider.connection, vaultPda);
        const expectedVaultBalance = BigInt(vaultTokenAccountBefore.amount.toString()) - BigInt(amountToSend1.toString());
        assert.equal(vaultTokenAccountAfter.amount.toString(), expectedVaultBalance.toString(), "Vault balance should decrease by the amount sent.");

        const winner1AtaBalanceAfter = (await getAccount(provider.connection, winner1Ata.address)).amount;
        const expectedWinner1AtaBalance = BigInt(winner1AtaBalanceBefore.toString()) + BigInt(amountToSend1.toString());
        assert.equal(winner1AtaBalanceAfter.toString(), expectedWinner1AtaBalance.toString(), "Winner1 ATA balance should increase by the amount sent.");

        console.log(`Winner1 ATA balance after: ${winner1AtaBalanceAfter.toString()}`);
        console.log(`Vault balance after: ${vaultTokenAccountAfter.amount.toString()}`);
        console.log(`Contest paidSoFar after: ${contestAccountAfter.paidSoFar.toString()}`);
    });

    it('initialize stake', async () => {
        const tx = await program.methods
            .initializeStake()
            .accountsStrict({
                payer: payer.publicKey,
                poolMint: usdcMint,
                stakeVault: stakeVaultPda,
                stakeAuthority: stakeAuthorityPda,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([payer.payer])
            .rpc();
        console.log("Initialize stake tx:", tx);
        await provider.connection.confirmTransaction(tx, "confirmed");
    });


    it('stake tokens', async () => {
        const stakeAcctPda = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("stake"), payer.publicKey.toBuffer()],
            program.programId
        )[0];

        const stakerAtaPda = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer.payer,
            usdcMint,
            payer.publicKey
        );
        await mintTo(
            provider.connection,
            payer.payer,
            usdcMint,
            stakerAtaPda.address,
            payer.payer,
            500_000 // 1 token with 6 decimals
        );

        const tx = await program.methods
            .stakeTokens(new BN(500_000))
            .accountsStrict({
                staker: payer.publicKey,
                stakeAcct: stakeAcctPda,
                stakeVault: stakeVaultPda,
                stakeAuthority: stakeAuthorityPda,
                stakerAta: stakerAtaPda.address,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([])
            .rpc();
        console.log("Stake tokens tx:", tx);
        await provider.connection.confirmTransaction(tx, "confirmed");
        const stakeAcct = await program.account.stakeAccount.fetch(stakeAcctPda);
        console.log("StakeAccount data:", stakeAcct);
        assert.equal(stakeAcct.amount.toNumber(), 500_000);
        assert.ok(stakeAcct.owner.equals(payer.publicKey));
        console.log("balance after stake:", stakeAcct.amount.toString());
    });

    it('unstake tokens', async () => {
        await sleep(10_000);
        const stakeAcctPda = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("stake"), payer.publicKey.toBuffer()],
            program.programId
        )[0];

        const stakerAtaPda = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer.payer,
            usdcMint,
            payer.publicKey
        );
        const tx = await program.methods
            .unstakeTokens(new BN(500_000))
            .accountsStrict({
                staker: payer.publicKey,
                stakeAcct: stakeAcctPda,
                stakeVault: stakeVaultPda,
                stakeAuthority: stakeAuthorityPda,
                stakerAta: stakerAtaPda.address,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([])
            .rpc();
        console.log("Unstake tokens tx:", tx);
        await provider.connection.confirmTransaction(tx, "confirmed");
        const stakeAcct = await program.account.stakeAccount.fetch(stakeAcctPda);
        console.log("StakeAccount data:", stakeAcct);
        assert.equal(stakeAcct.amount.toNumber(), 0);
        assert.ok(stakeAcct.owner.equals(payer.publicKey));
        console.log("balance after unstake:", stakeAcct.amount.toString());
    });
})