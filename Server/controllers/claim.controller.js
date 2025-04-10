import { asyncHandler } from "../utils/asyncHandler.js";
import Claim from "../models/claim.models.js";
import FoundItem from "../models/items.models.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendEmail } from "../utils/sendEmail.js";

// Create a claim for an item
export const createClaim = asyncHandler(async (req, res) => {
    const { itemId, claimantName, claimantEmail, answers } = req.body;

    if (!itemId || !claimantName || !claimantEmail || !answers || answers.length === 0) {
        return res.status(400).json(new ApiResponse(400, null, "All fields are required"));
    }

    const item = await FoundItem.findById(itemId);
    if (!item) {
        return res.status(404).json(new ApiResponse(404, null, "Item not found"));
    }

    const existingClaim = await Claim.findOne({ itemId, claimantEmail });
    if (existingClaim) {
        return res.status(400).json(
            new ApiResponse(400, null, "You have already submitted a claim for this item")
        );
    }

    const claim = await Claim.create({
        itemId,
        claimantName,
        claimantEmail,
        answers,
    });

    return res.status(201).json(new ApiResponse(201, claim, "Claim submitted successfully"));
});

// Get all claims for a specific item
export const getClaimsForItem = asyncHandler(async (req, res) => {
    const { itemId } = req.params;

    const item = await FoundItem.findById(itemId);
    if (!item) {
        return res.status(404).json(new ApiResponse(404, null, "Item not found"));
    }

    const claims = await Claim.find({ itemId });

    return res.status(200).json(new ApiResponse(200, claims, "Claims for this item fetched successfully"));
});

// Approve a claim and notify the claimer
export const approveClaim = asyncHandler(async (req, res) => {
    const { claimId } = req.params;

    const claim = await Claim.findById(claimId);
    if (!claim) {
        return res.status(404).json(new ApiResponse(404, null, "Claim not found"));
    }

    claim.status = "approved";
    await claim.save();

    const item = await FoundItem.findById(claim.itemId);
    if (!item) {
        return res.status(404).json(new ApiResponse(404, null, "Item not found"));
    }

    item.isClaimed = true;
    await item.save();

    try {
        await sendEmail({
            to: claim.claimantEmail,
            subject: "Claim Approved – Lost & Found",
            text: `Hi ${claim.claimantName},

Your claim for the item "${item.itemType}" has been approved!

Here are the finder's contact details:

Name: ${item.finderName}
Email: ${item.finderEmail}
Phone: ${item.finderPhone}

Please get in touch with them to retrieve your item.

– Team Lost & Found`,
        });
    } catch (error) {
        return res.status(500).json(new ApiResponse(500, null, "Failed to send approval email"));
    }

    return res.status(200).json(new ApiResponse(200, null, "Claim approved and email sent."));
});

// Reject a claim and notify the claimer
export const rejectClaim = asyncHandler(async (req, res) => {
    const { claimId } = req.params;

    const claim = await Claim.findById(claimId);
    if (!claim) {
        return res.status(404).json(new ApiResponse(404, null, "Claim not found"));
    }

    const item = await FoundItem.findById(claim.itemId);

    try {
        await sendEmail({
            to: claim.claimantEmail,
            subject: "Claim Rejected – Lost & Found",
            text: `Hi ${claim.claimantName},

Thank you for submitting your claim for the item "${item?.itemType ?? "Unknown"}".

After reviewing your answers, the finder was unable to confirm a match, so your claim has been declined.

You're welcome to continue browsing the Lost & Found board in case someone else has reported your item.

– Team Lost & Found`,
        });
    } catch (error) {
        return res.status(500).json(new ApiResponse(500, null, "Failed to send rejection email"));
    }

    claim.status = "rejected";
    await claim.save();

    return res.status(200).json(new ApiResponse(200, null, "Claim rejected and email sent."));
});
