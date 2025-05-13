use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Contest is closed or not accepting entries")] ContestClosed,
    #[msg("Arithmetic overflow occurred")] NumericalOverflow,
    #[msg("Must attempt exactly 9 questions")] InvalidAttemptMask,
    #[msg("Answer bits outside attempted mask")] InvalidAnswerBits,
    #[msg("Invalid owner")] InvalidOwner,
    #[msg("Invalid mint")] InvalidMint,
    #[msg("Invalid answer key")] InvalidAnswerKey,
    #[msg("winners and amounts must have same non-zero length")]
    InvalidArguments,
    #[msg("batch cannot be empty")]
    EmptyBatch,
    #[msg("provided account is not a valid participant PDA for this contest")]
    InvalidParticipant,
    #[msg("Contest is not in the correct state")]
    ContestNotAnswerKeyPosted,
    #[msg("Contest is not in the correct state")]
    ContestNotLocked,
    #[msg("Contest is not in the correct state")]
    AnswerKeyNotSet,
    #[msg("Invalid winner count")]
    InvalidWinnerCount,
    #[msg("Invalid contest id passed")]
    InvalidContestId,
    #[msg("Stake is locked")]
    StakeLocked,
    #[msg("Invalid unstake amount")]
    InvalidUnstakeAmount,

}